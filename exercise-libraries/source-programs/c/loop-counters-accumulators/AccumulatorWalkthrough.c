/*
@codescope
@title Watch an accumulator grow
@seed limit min=3 max=5
@seed amount min=1 max=3
*/
#include <stdio.h>

int main(void) {
    int count = 0;
    int limit = 4;
    int amount = 2;
    int total = 0;

    printf("ACCUMULATOR WALKTHROUGH\n\n");

    while (count < limit) {
        total += amount;
        count++;
        printf("%d ", total);
    }
    
    printf("\nACCUMULATION COMPLETE\n");
    printf("TOTAL: %d\n", total);

    return 0;
}
