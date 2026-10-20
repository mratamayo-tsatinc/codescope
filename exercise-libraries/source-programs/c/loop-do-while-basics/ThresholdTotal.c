/*
@codescope
@title Accumulate to a threshold
@seed amount min=1 max=3
@seed limit min=5 max=8
*/
#include <stdio.h>

int main(void) {
    int amount = 2;
    int total = 0;
    int limit = 6;

    printf("TOTALS TOWARD %d\n\n", limit);

    do {
        total += amount;
        printf("%d\n", total);
    } while (total < limit);

    printf("\nTHRESHOLD REACHED: %d\n", total);

    return 0;
}

