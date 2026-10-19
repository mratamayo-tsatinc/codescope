/*
@codescope
@title See the false test after one pass
@seed score min=7 max=9
@seed target min=4 max=6
*/
#include <stdio.h>

int main(void) {
    int score = 8;
    int target = 5;

    do {
        score++;
        printf("%d\n", score);
    } while (score < target);

    printf("stopped %d\n", score);

    return 0;
}

