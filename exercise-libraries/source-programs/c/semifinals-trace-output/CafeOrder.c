/*
@codescope
@title Cafe Order Summary
@seed drinks min=2 max=6
@seed unitPrice min=45 max=75 step=5
@seed voucher min=10 max=30 step=5
*/
#include <stdio.h>

int main(void)
{
    int drinks = 4;
    int unitPrice = 60;
    int voucher = 20;
    int subtotal;
    int amountDue;

    subtotal = drinks * unitPrice;
    amountDue = subtotal - voucher;

    printf("CAFE ORDER\n");
    printf("%d drinks at P%d\n", drinks, unitPrice);
    printf("Voucher: P%d\n", voucher);
    printf("Amount due: P%d\n", amountDue);

    return 0;
}

