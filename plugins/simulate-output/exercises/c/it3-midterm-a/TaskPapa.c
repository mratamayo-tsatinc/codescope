/*
@output
Initial value of a: 5
Initial value of b: 5
Initial value of c: 10
Initial value of d: 10

Updated value of a: 4
Updated value of b: 6
Updated value of c: 11
Updated value of d: 9

sum = ++p + q++ : 9
final p: 5
final q: 5

@variables
a = 4
b = 6
c = 11
d = 9
p = 5
q = 5
sum = 9
*/
#include <stdio.h>

int main() {
    int a = 5;
    int b = 5;
    int c = 10;
    int d = 10;

    printf("Initial value of a: %d\n", a);
    printf("Initial value of b: %d\n", b);
    printf("Initial value of c: %d\n", c);
    printf("Initial value of d: %d\n", d);
    printf("\n");

    a--;
    ++b;
    c++;
    --d;

    printf("Updated value of a: %d\n", a);
    printf("Updated value of b: %d\n", b);
    printf("Updated value of c: %d\n", c);
    printf("Updated value of d: %d\n", d);
    printf("\n");

    int p = 4;
    int q = 4;
    int sum = ++p + q++;

    printf("sum = ++p + q++ : %d\n", sum);
    printf("final p: %d\n", p);
    printf("final q: %d\n", q);

    return 0;
}