/*
@codescope
@title Add a fixed amount repeatedly
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 4;
    int total = 0;

    for (i = 0; i < limit; i++) {
        total += 2;
    }

    printf("total %d\n", total);

    return 0;
}

