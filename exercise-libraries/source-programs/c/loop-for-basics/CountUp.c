/*
@codescope
@title Count up with for
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 4;

    for (i = 1; i <= limit; i++) {
        printf("%d\n", i);
    }

    printf("done %d\n", i);

    return 0;
}

