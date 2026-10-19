/*
@codescope
@title A while loop that may not run
@seed value min=4 max=6
@seed limit min=2 max=3
*/
#include <stdio.h>

int main(void) {
    int value = 5;
    int limit = 3;

    while (value < limit) {
        value++;
    }

    printf("value %d\n", value);

    return 0;
}

