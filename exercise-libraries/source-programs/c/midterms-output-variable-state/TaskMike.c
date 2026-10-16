/*
@codescope
@title Relational results
@seed x min=5 max=15
@seed y min=5 max=15
*/
#include <stdio.h>

int main() {
    int x = 10;
    int y = 7;

    int isEqual = (x == y);
    int isNotEqual = (x != y);
    int isGreater = (x > y);
    int isLessOrEqual = (x <= y);
    int isEqualToItself = (x == 10);

    printf("x = %d, y = %d\n", x, y);
    printf("x == y : %d\n", isEqual);
    printf("x != y : %d\n", isNotEqual);
    printf("x > y  : %d\n", isGreater);
    printf("x <= y : %d\n", isLessOrEqual);
    printf("x == 10 : %d\n", isEqualToItself);

    return 0;
}
