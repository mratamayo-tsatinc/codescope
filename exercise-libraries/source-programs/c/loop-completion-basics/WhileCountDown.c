/*
@codescope
@title Complete a while countdown loop
@seed count min=3 max=6
*/
#include <stdio.h>

int main(void) {
    int count = 4;

    while (count > 0) {
        printf("%d\n", count);
        count--;
    }

    printf("LIFT OFF\n");
    printf("FINAL COUNT: %d\n", count);
    return 0;
}
