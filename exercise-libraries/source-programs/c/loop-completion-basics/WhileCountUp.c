/*
@codescope
@title Complete a while count up loop
@seed limit min=3 max=6
*/
#include <stdio.h>

int main(void) {
    int count = 1;
    int limit = 4;

    while (count <= limit) {
        printf("%d\n", count);
        count++;
    }

    printf("FINAL COUNT: %d\n", count);
    return 0;
}
