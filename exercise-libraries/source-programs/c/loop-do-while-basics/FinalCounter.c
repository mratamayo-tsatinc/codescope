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
        printf("%d\n", count);
    } while (count <= limit);

    printf("FINAL COUNT: %d\n", count);

    return 0;
}

