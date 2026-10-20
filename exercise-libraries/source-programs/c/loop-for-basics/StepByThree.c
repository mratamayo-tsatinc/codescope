/*
@codescope
@title Increment a for loop by three
@seed limit min=7 max=10
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 9;

    for (i = 0; i < limit; i += 3) {
        printf("%d\n", i);
    }

    printf("FINAL VALUE: %d\n", i);

    return 0;
}

