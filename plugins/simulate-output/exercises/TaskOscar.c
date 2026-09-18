/*
@output
Welcome to Tech Haven!

@variables
isLoyalMember = 1
qualifiesForDiscount = 1
subtotal = 2400.00
discount = 240.00
taxedAmount = 172.8000
finalTotal = 2332.80
MEMBER_DISCOUNT_YEARS = 2
*/
#include <stdio.h>
#define TAX_RATE 0.08
#define SHOP_NAME "Tech Haven"

int main() {
    const int MEMBER_DISCOUNT_YEARS = 2;

    char customerName[] = "Diego";
    int yearsAsMember = 3;
    float itemPrice = 1200.0;
    int quantity = 2;

    printf("Welcome to %s!\n", SHOP_NAME);

    int isLoyalMember = (yearsAsMember >= MEMBER_DISCOUNT_YEARS);
    float subtotal = itemPrice * quantity;
    int qualifiesForDiscount = isLoyalMember && (subtotal > 1000);
    float discount = subtotal * 0.10 * qualifiesForDiscount;
    float taxedAmount = (subtotal - discount) * TAX_RATE;
    float finalTotal = subtotal - discount + taxedAmount;

    return 0;
}