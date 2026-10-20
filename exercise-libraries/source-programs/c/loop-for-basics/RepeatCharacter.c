/*
@codescope
@title Repeat a character with for
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 4;

    for (i = 0; i < limit; i++) {
        printf("*\n");
        printf("-----\n");
    }

    printf("FINISHED\n");

    return 0;
}
