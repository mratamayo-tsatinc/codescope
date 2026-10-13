/*
@codescope
@title Pharmacy Order
@seed unitPrice min=15 max=35 step=5
@input target=quantity value=6 min=1 max=12
*/
#include <stdio.h>

int main(void)
{
    int quantity;
    int unitPrice = 25;
    int orderTotal;

    printf("Medicine quantity: ");
    scanf("%d", &quantity);
    orderTotal = quantity * unitPrice;

    printf("PHARMACY ORDER\n");
    printf("Prepared units: %d\n", quantity);
    printf("Payment due: P%d\n", orderTotal);

    return 0;
}

