package com.foodflow;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class Pricing {
    private Pricing() {}
    public record Amounts(BigDecimal subtotal, BigDecimal vat, BigDecimal total) {}
    public static Amounts calculate(BigDecimal amount, boolean included, BigDecimal rate) {
        BigDecimal total = included ? amount : amount.multiply(BigDecimal.ONE.add(rate.movePointLeft(2))).setScale(2, RoundingMode.HALF_UP);
        BigDecimal subtotal = included ? total.divide(BigDecimal.ONE.add(rate.movePointLeft(2)), 2, RoundingMode.HALF_UP) : amount.setScale(2, RoundingMode.HALF_UP);
        return new Amounts(subtotal, total.subtract(subtotal), total.setScale(2, RoundingMode.HALF_UP));
    }
}
