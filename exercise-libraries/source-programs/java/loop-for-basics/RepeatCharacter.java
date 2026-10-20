/*
@codescope
@title Repeat a character with for
@seed limit min=3 max=5
*/
public class RepeatCharacter {
    public static void main(String[] args) {
        int i;
        int limit = 4;

        for (i = 0; i < limit; i++) {
            System.out.println("*");
            System.out.println("-----");
        }

        System.out.println("FINISHED");
    }
}
