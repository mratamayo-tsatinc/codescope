/*
@codescope
@title Shipping Lane
@seed weight min=2 max=14 step=2
@seed baseFee min=60 max=100 step=10
*/
#include <stdio.h>

int main(void)
{
    int weight = 8;
    int baseFee = 80;
    int shippingFee;
    int lane;

    if (weight <= 3) {
        lane = 1;
        shippingFee = baseFee;
    } else if (weight <= 8) {
        lane = 2;
        shippingFee = baseFee + 50;
    } else {
        lane = 3;
        shippingFee = baseFee + 120;
    }

    printf("SHIPPING ASSIGNMENT\n");
    printf("Processing lane: %d\n", lane);
    printf("Shipping fee: P%d\n", shippingFee);

    return 0;
}

