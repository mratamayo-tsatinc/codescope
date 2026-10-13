/*
@codescope
@title Store Pickup
@seed stock min=3 max=9
@seed requested min=2 max=8
@seed unitPrice min=80 max=140 step=20
*/
#include <stdio.h>

int main(void)
{
    int stock = 7;
    int requested = 5;
    int unitPrice = 100;
    int released;
    int payment;

    if (requested <= stock) {
        released = requested;
        payment = released * unitPrice;
    } else {
        released = 0;
        payment = 0;
    }

    printf("STORE PICKUP\n");
    printf("Released items: %d\n", released);
    printf("Counter payment: P%d\n", payment);

    return 0;
}

