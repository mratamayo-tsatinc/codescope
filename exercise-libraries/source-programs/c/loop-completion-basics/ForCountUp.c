/*
@codescope
@title Complete a for count up loop
@seed limit min=3 max=6
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 4;

    for (i = 1; i <= limit; i++) {
        printf("%d\n", i);
    }

    printf("FINAL INDEX: %d\n", i);
    return 0;
}
