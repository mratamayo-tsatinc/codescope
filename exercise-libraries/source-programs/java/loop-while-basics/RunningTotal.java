/*
@codescope
@title Add values in a while loop
@seed limit min=3 max=5
*/
public class RunningTotal {
    public static void main(String[] args) {
        int i = 1;
        int limit = 4;
        int total = 0;

        while (i <= limit) {
            total += i;
            i++;
        }

        System.out.println("total " + total);
    }
}

