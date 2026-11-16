package com.baromi.backend.shop;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.transaction.annotation.Transactional;
import com.baromi.backend.scan.ScanRepository;

@RestController
@RequestMapping("/api/v1/shops")
public class ShopController {
    private final ShopRepository shops;
    private final ScanRepository scans;

    public ShopController(ShopRepository shops, ScanRepository scans) { this.shops = shops; this.scans = scans; }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestHeader("X-Baromi-Owner") String owner,
                                    @RequestBody CreateShopRequest request) {
        if (owner.isBlank() || request == null || request.consent() != Boolean.TRUE || !isPublicHttps(request.url())) {
            return ResponseEntity.badRequest().body(Map.of("error", "공개 HTTPS 쇼핑몰 URL과 검사 동의가 필요합니다."));
        }
        if (request.id() != null) {
            var existing = shops.findByIdAndOwnerHash(request.id(), ownerHashForApi(owner));
            if (existing.isPresent()) return ResponseEntity.ok(Map.of("shopId", existing.get().getId(), "url", existing.get().getUrl(), "mirrored", true));
        }
        var ownerHash = ownerHashForApi(owner);
        var duplicate = shops.findByOwnerHashAndUrlOrderByConsentAtAsc(ownerHash, request.url());
        if (!duplicate.isEmpty()) {
            var keeper = duplicate.get(0);
            for (var repeated : duplicate.subList(1, duplicate.size())) {
                scans.moveShopScans(repeated.getId(), keeper.getId());
                if (keeper.getNickname() == null && repeated.getNickname() != null) keeper.setNickname(repeated.getNickname());
                shops.delete(repeated);
            }
            if (keeper.getNickname() == null && request.nickname() != null && !request.nickname().isBlank()) {
                keeper.setNickname(request.nickname().trim());
                shops.save(keeper);
            }
            return ResponseEntity.ok(Map.of("shopId", keeper.getId(), "url", keeper.getUrl(), "nickname", keeper.getNickname() == null ? "" : keeper.getNickname(), "existing", true));
        }
        var entity = new ShopEntity(request.id() == null ? UUID.randomUUID().toString() : request.id(), request.url(), ownerHash, Instant.now());
        if (request.nickname() != null && !request.nickname().isBlank()) entity.setNickname(request.nickname().trim());
        entity = shops.save(entity);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("shopId", entity.getId(), "url", entity.getUrl()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> rename(@RequestHeader("X-Baromi-Owner") String owner, @PathVariable String id, @RequestBody RenameShopRequest request) {
        if (request == null || request.nickname() == null || request.nickname().trim().isEmpty() || request.nickname().trim().length() > 80)
            return ResponseEntity.badRequest().body(Map.of("error", "쇼핑몰 이름은 1~80자로 입력해 주세요."));
        return shops.findByIdAndOwnerHash(id, ownerHashForApi(owner)).<ResponseEntity<?>>map(shop -> {
            shop.setNickname(request.nickname().trim());
            var saved = shops.save(shop);
            return ResponseEntity.ok(Map.of("shopId", saved.getId(), "url", saved.getUrl(), "nickname", saved.getNickname()));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@RequestHeader("X-Baromi-Owner") String owner, @PathVariable String id) {
        return shops.findByIdAndOwnerHash(id, ownerHashForApi(owner))
            .<ResponseEntity<?>>map(shop -> {
                var body = new java.util.LinkedHashMap<String, Object>();
                body.put("shopId", shop.getId()); body.put("url", shop.getUrl()); body.put("nickname", shop.getNickname());
                body.put("consentAt", shop.getConsentAt()); body.put("verifiedAt", shop.getVerifiedAt());
                return ResponseEntity.ok(body);
            })
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    @Transactional
    public ResponseEntity<?> list(@RequestHeader("X-Baromi-Owner") String owner,
                                  @RequestParam(defaultValue = "50") int limit) {
        if (owner.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "소유자 인증이 필요합니다."));
        var safeLimit = Math.min(Math.max(limit, 1), 100);
        var ownerHash = ownerHashForApi(owner);
        var all = shops.findByOwnerHashOrderByConsentAtAsc(ownerHash);
        var keepers = new java.util.LinkedHashMap<String, ShopEntity>();
        for (var shop : all) {
            String key = normalizedUrl(shop.getUrl());
            var keeper = keepers.putIfAbsent(key, shop);
            if (keeper != null) {
                scans.moveShopScans(shop.getId(), keeper.getId());
                if (keeper.getNickname() == null && shop.getNickname() != null) keeper.setNickname(shop.getNickname());
                shops.delete(shop);
            }
        }
        var items = shops.findByOwnerHashOrderByConsentAtDesc(ownerHash, PageRequest.of(0, safeLimit))
            .stream().map(shop -> {
                var item = new java.util.LinkedHashMap<String, Object>();
                item.put("shopId", shop.getId()); item.put("url", shop.getUrl());
                item.put("nickname", shop.getNickname());
                item.put("consentAt", shop.getConsentAt()); item.put("verifiedAt", shop.getVerifiedAt());
                return item;
            }).toList();
        return ResponseEntity.ok(Map.of("limit", safeLimit, "shops", items));
    }

    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@RequestHeader("X-Baromi-Owner") String owner, @PathVariable String id) {
        var shop = shops.findByIdAndOwnerHash(id, ownerHashForApi(owner));
        if (shop.isEmpty()) return ResponseEntity.notFound().build();
        var history = scans.findByShopIdOrderByCreatedAtDesc(id);
        if (history.stream().anyMatch(scan -> "queued".equals(scan.getStatus()) || "running".equals(scan.getStatus()))) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "진행 중인 진단이 있어 쇼핑몰을 삭제할 수 없습니다."));
        }
        var scanIds = history.stream().map(scan -> scan.getId()).toList();
        scans.deleteByShopId(id);
        shops.delete(shop.get());
        return ResponseEntity.ok(Map.of("deleted", true, "shopId", id, "deletedScanIds", scanIds));
    }

    public record CreateShopRequest(String id, String url, Boolean consent, String nickname) {}
    public record RenameShopRequest(String nickname) {}

    private static String normalizedUrl(String raw) {
        try {
            var uri = URI.create(raw).normalize();
            String path = uri.getPath() == null ? "" : uri.getPath().replaceAll("/+$", "");
            return uri.getScheme().toLowerCase() + "://" + uri.getHost().toLowerCase() + path + (uri.getQuery() == null ? "" : "?" + uri.getQuery());
        } catch (RuntimeException invalid) { return raw; }
    }

    public static String ownerHashForApi(String owner) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(owner.getBytes(StandardCharsets.UTF_8));
            var hex = new StringBuilder(digest.length * 2);
            for (byte value : digest) hex.append(String.format("%02x", value));
            return hex.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", impossible);
        }
    }

    private static boolean isPublicHttps(String raw) {
        try {
            var uri = URI.create(raw);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getPort() == -1
                && !uri.getHost().equalsIgnoreCase("localhost") && !uri.getHost().startsWith("127.");
        } catch (IllegalArgumentException ignored) { return false; }
    }
}

