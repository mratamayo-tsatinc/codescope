/*
@codescope
@title Observe a for counter after exit
@seed limit min=2 max=5
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 3;

    for (i = 0; i < limit; i++) {
        printf("loop %d\n", i);
    }

    printf("after %d\n", i);

    return 0;
}

