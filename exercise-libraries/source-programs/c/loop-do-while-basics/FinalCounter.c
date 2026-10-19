/*
@codescope
@title Observe the final counter
@seed limit min=2 max=4
*/
#include <stdio.h>

int main(void) {
    int count = 1;
    int limit = 3;

    do {
        count++;
    } while (count <= limit);

    printf("count %d\n", count);

    return 0;
}

