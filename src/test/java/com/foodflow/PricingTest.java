package com.foodflow;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class PricingTest {
    @Test void inclusiveVatDoesNotIncreaseTheQuotedPackageTotal() {
        var p=Pricing.calculate(new BigDecimal("1395.00"),true,new BigDecimal("7"));
        assertEquals(new BigDecimal("1303.74"),p.subtotal());
        assertEquals(new BigDecimal("91.26"),p.vat());
        assertEquals(new BigDecimal("1395.00"),p.total());
    }
    @Test void exclusiveVatIsAddedOnceAndRoundedToSatang() {
        var p=Pricing.calculate(new BigDecimal("1395.00"),false,new BigDecimal("7"));
        assertEquals(new BigDecimal("97.65"),p.vat());
        assertEquals(new BigDecimal("1492.65"),p.total());
        assertEquals(p.total(),p.subtotal().add(p.vat()));
    }
}
