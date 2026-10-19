/*
@codescope
@title A one-iteration while loop
@seed limit min=1 max=1
*/
#include <stdio.h>

int main(void) {
    int count = 0;
    int limit = 1;

    while (count < limit) {
        count++;
    }

    printf("count %d\n", count);

    return 0;
}

