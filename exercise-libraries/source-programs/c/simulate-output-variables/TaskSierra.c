/*
@codescope
@title Store calculations with constants
@seed TAX_RATE min=0.05 max=0.12 decimals=2
@seed SHOP_NAME values="Tech Haven"|"Code Corner"|"Byte Market"
@seed MEMBER_DISCOUNT_YEARS min=1 max=5
@seed customerName values="Diego"|"Maria"|"Amina"
@seed yearsAsMember min=1 max=8
@seed itemPrice min=800.00 max=1500.00 decimals=2
@seed quantity min=1 max=5
*/
#include <stdio.h>
#define TAX_RATE 0.08
#define SHOP_NAME "Tech Haven"

int main() {
    const int MEMBER_DISCOUNT_YEARS = 2;

    char customerName[] = "Diego";
    int yearsAsMember = 3;
    float itemPrice = 1200.25;
    int quantity = 2;

    printf("Welcome to %s!\n", SHOP_NAME);
    printf("Customer: \"%s\"\n", customerName);

    int isLoyalMember = (yearsAsMember >= MEMBER_DISCOUNT_YEARS);
    float subtotal = itemPrice * quantity;
    int qualifiesForDiscount = isLoyalMember && (subtotal > 1000);
    float discount = subtotal * 0.10 * qualifiesForDiscount;
    float taxedAmount = (subtotal - discount) * TAX_RATE;
    float finalTotal = subtotal - discount + taxedAmount;

    printf("Quantity: %d\n", quantity);
    printf("Subtotal: %.2f\n", subtotal);
    printf("Is loyal member: %d\n", isLoyalMember);
    printf("Discount: %.2f\n", discount);
    printf("Tax: %0.4f\n", taxedAmount);
    printf("Final Total: %.2f\n", finalTotal);
    printf("Have a great day, %s!\n", customerName);

    return 0;
}
