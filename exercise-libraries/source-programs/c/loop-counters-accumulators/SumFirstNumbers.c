/*
@codescope
@title Counter and sum accumulator
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i = 1;
    int limit = 4;
    int total = 0;

    while (i <= limit) {
        total += i;
        i++;
    }

    printf("count %d total %d\n", i, total);

    return 0;
}

