/*
@codescope
@title Count up with do while
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i = 1;
    int limit = 4;

    printf("DO-WHILE COUNT UP\n\n");

    do {
        printf("%d\n", i);
        i++;
    } while (i <= limit);

    printf("\nCOUNTING COMPLETE: %d\n", i);

    return 0;
}

