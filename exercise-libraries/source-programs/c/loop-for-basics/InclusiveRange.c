/*
@codescope
@title Use an inclusive for condition
@seed start min=1 max=2
@seed limit min=4 max=6
*/
#include <stdio.h>

int main(void) {
    int i;
    int start = 2;
    int limit = 5;

    for (i = start; i <= limit; i++) {
        printf("%d\n", i);
    }

    printf("final %d\n", i);

    return 0;
}

