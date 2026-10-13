/*
@codescope
@title Warehouse Dispatch
@seed stock min=8 max=24 step=2
@seed requested min=5 max=15
@seed destination min=1 max=3
*/
#include <stdio.h>

int main(void)
{
    int stock = 18;
    int requested = 12;
    int destination = 2;
    int dispatched = 0;
    int handlingFee;

    if (requested <= stock) {
        dispatched = requested;
    }

    switch (destination)
    {
        case 1:
            handlingFee = 40;
            break;
        case 2:
            handlingFee = 70;
            break;
        default:
            handlingFee = 100;
    }

    printf("WAREHOUSE DISPATCH\n");
    printf("Released units: %d\n", dispatched);
    printf("Handling fee: P%d\n", handlingFee);

    return 0;
}

