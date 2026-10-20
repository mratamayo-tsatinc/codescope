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

    printf("COUNT UP -> START!\n\n");

    while (i <= limit) {
        printf("%d\n", i);
        i++;
    }

    printf("\n");
    printf("COUNT UP -> END\n");

    return 0;
}

