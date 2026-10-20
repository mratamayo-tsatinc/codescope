/*
@codescope
@title Accumulate squared counter values
@seed limit min=2 max=4
*/
#include <stdio.h>

int main(void) {
    int i = 1;
    int limit = 3;
    int total = 0;

    printf("SUM OF SQUARE VALUES FROM %d to %d: \n\n", i, limit);
    printf("-----------\n");

    for (i = 1; i <= limit; i++) {
        total += i * i;
        printf("%d\n", total);
    }
    
    printf("-----------\n\n");
    printf("SUM OF ALL SQUARE VALUES IS %d\n", total);

    return 0;
}

