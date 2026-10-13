/*
@codescope
@title Market Purchase
@seed quantity min=2 max=6
@seed unitPrice min=35 max=65 step=5
@seed cash min=300 max=500 step=50
*/
#include <stdio.h>

int main(void)
{
    int quantity = 4;
    int unitPrice = 50;
    int cash = 400;
    int purchaseTotal;
    int change;

    purchaseTotal = quantity * unitPrice;
    change = cash - purchaseTotal;

    printf("MARKET PURCHASE\n");
    printf("Basket total: P%d\n", purchaseTotal);
    printf("Change: P%d\n", change);

    return 0;
}

