/*
@codescope
@title Accumulate squared counter values
@seed limit min=2 max=4
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 3;
    int total = 0;

    for (i = 1; i <= limit; i++) {
        total += i * i;
    }

    printf("total %d\n", total);

    return 0;
}

