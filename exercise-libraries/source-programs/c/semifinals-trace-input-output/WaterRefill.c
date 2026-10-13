/*
@codescope
@title Water Refill Station
@seed pricePerContainer min=25 max=45 step=5
@input target=containers value=3 min=1 max=8
*/
#include <stdio.h>

int main(void)
{
    int containers;
    int pricePerContainer = 35;
    int refillTotal;

    printf("Containers for refill: ");
    scanf("%d", &containers);
    refillTotal = containers * pricePerContainer;

    printf("WATER REFILL\n");
    printf("Containers filled: %d\n", containers);
    printf("Collection total: P%d\n", refillTotal);

    return 0;
}

