/*
@codescope
@title Track the value after exit
@seed step min=1 max=2
@seed limit min=5 max=7
*/
#include <stdio.h>

int main(void) {
    int value = 1;
    int step = 2;
    int limit = 6;

    while (value < limit) {
        printf("=============\n");
        value += step;
    }

    printf("final %d\n", value);

    return 0;
}

