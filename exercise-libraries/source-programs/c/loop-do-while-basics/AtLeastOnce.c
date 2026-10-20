/*
@codescope
@title Do while runs at least once
@seed value min=4 max=6
@seed limit min=2 max=3
*/
#include <stdio.h>

int main(void) {
    int value = 5;
    int limit = 3;

    printf("BODY RUNS BEFORE THE TEST\n\n");

    do {
        printf("%d\n", value);
        value++;
    } while (value < limit);

    printf("\nFINAL VALUE: %d\n", value);

    return 0;
}

