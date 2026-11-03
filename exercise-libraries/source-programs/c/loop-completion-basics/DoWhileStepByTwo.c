/*
@codescope
@title Complete a do while step-by-two loop
@seed limit min=5 max=9
*/
#include <stdio.h>

int main(void) {
    int number = 1;
    int limit = 7;

    do {
        printf("%d\n", number);
        number += 2;
    } while (number < limit);

    printf("FINAL NUMBER: %d\n", number);
    return 0;
}
