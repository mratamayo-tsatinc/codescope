/*
@codescope
@title Count up with while
@seed i min=1 max=2
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i = 1;
    int limit = 4;

    while (i <= limit) {
        printf("%d\n", i);
        i++;
    }

    printf("done %d\n", i);

    return 0;
}

