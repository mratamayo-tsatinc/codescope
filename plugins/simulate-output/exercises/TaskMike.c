/*
@output
x = 10, y = 7
x == y : 0
x != y : 1
x > y  : 1
x <= y : 0
x == 10 : 1

@variables
isEqual = 0
isNotEqual = 1
isGreater = 1
isLessOrEqual = 0
isEqualToItself = 1
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