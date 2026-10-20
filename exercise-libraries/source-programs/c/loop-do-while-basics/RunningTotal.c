/*
@codescope
@title Add values with do while
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i = 1;
    int limit = 4;
    int total = 0;

    printf("RUNNING TOTALS\n\n");

    do {
        total += i;
        printf("%d\n", total);
        i++;
    } while (i <= limit);

    printf("\nFINAL TOTAL: %d\n", total);

    return 0;
}

