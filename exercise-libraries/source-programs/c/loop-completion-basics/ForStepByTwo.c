/*
@codescope
@title Complete a for step-by-two loop
@seed limit min=6 max=10
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 8;

    for (i = 0; i < limit; i += 2) {
        printf("%d\n", i);
    }

    printf("FINAL INDEX: %d\n", i);
    return 0;
}
