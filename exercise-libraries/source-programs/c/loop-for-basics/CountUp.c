/*
@codescope
@title Count up with for
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 4;

    printf("FOR LOOP COUNT UP\n\n");

    for (i = 1; i <= limit; i++) {
        printf("%d\n", i);
    }

    printf("\nCOUNTING COMPLETE: %d\n", i);

    return 0;
}

