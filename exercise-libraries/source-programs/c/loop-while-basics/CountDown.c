/*
@codescope
@title Count down with while
@seed count min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int count = 4;
    printf("+-------------------+\n");
    printf("|  While Loop Demo! |\n");
    printf("+-------------------+\n\n");

    while (count > 0) {
        printf("%d\n", count);
        count--;
    }

    printf("\n\n+-------------------+\n");
    printf("|      LIFT OFF     |\n");
    printf("+-------------------+\n");

    return 0;
}

