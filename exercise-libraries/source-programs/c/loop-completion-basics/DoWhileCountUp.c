/*
@codescope
@title Complete a do while count up loop
@seed limit min=3 max=6
*/
#include <stdio.h>

int main(void) {
    int count = 1;
    int limit = 4;

    do {
        printf("%d\n", count);
        count++;
    } while (count <= limit);

    printf("FINAL COUNT: %d\n", count);
    return 0;
}
