/*
@codescope
@title Start a for loop above zero
@seed start min=2 max=3
@seed limit min=5 max=7
*/
#include <stdio.h>

int main(void) {
    int i;
    int start = 3;
    int limit = 6;

    printf("START AT %d\n\n", start);

    for (i = start; i < limit; i++) {
        printf("%d\n", i);
    }

    printf("FINAL VALUE: %d\n", i);

    return 0;
}

