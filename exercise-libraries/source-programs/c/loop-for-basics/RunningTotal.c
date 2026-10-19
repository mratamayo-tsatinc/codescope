/*
@codescope
@title Sum values with for
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 4;
    int total = 0;

    for (i = 1; i <= limit; i++) {
        total += i;
    }

    printf("total %d\n", total);

    return 0;
}

