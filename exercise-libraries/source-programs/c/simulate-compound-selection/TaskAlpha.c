/*
@codescope
@title Store Transaction
@seed itemCost min=430 max=470 step=10
@seed quantity min=2 max=4
*/
#include <stdio.h>

int main(void)
{
    int itemCost = 450, quantity = 3, discount = 50;
    int subtotal, total, canBuy;

    subtotal = itemCost * quantity + 20 * 2;
    canBuy = (quantity > 0 && subtotal >= 500) || !((itemCost < 100));

    if (canBuy && subtotal >= 1000) {
        discount = discount + 25;
    } else if (canBuy || quantity == 1) {
        discount = discount + 10;
    } else {
        discount = 0;
    }

    total = subtotal - discount;

    printf("itemCost = %d\n", itemCost);
    printf("quantity = %d\n", quantity);
    printf("discount = %d\n", discount);
    printf("subtotal = %d\n", subtotal);
    printf("total = %d\n", total);
    printf("canBuy = %d\n", canBuy);
    return 0;
}
