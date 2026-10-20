/*
@codescope
@title Start from a seeded value
@seed value min=1 max=3
@seed limit min=4 max=6
*/
#include <stdio.h>

int main(void) {
    int value = 2;
    int limit = 5;

    while (value < limit) {
        printf("%d\n", value);
        printf("#####\n");
        value++;
    }

    printf("final %d\n", value);

    return 0;
}

