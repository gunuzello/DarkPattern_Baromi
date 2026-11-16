package com.baromi.backend.shop;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

public interface ShopRepository extends JpaRepository<ShopEntity, String> {
    Optional<ShopEntity> findByIdAndOwnerHash(String id, String ownerHash);
    java.util.List<ShopEntity> findByOwnerHashOrderByConsentAtDesc(String ownerHash, Pageable pageable);
    Optional<ShopEntity> findFirstByOwnerHashAndUrl(String ownerHash, String url);
    java.util.List<ShopEntity> findByOwnerHashAndUrlOrderByConsentAtAsc(String ownerHash, String url);
    java.util.List<ShopEntity> findByOwnerHashOrderByConsentAtAsc(String ownerHash);
}

